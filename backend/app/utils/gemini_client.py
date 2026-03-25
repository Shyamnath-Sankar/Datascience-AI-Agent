"""
Gemini Client for AI interactions.
Wrapper around Google Gen AI SDK (google-genai).
Features:
- Proper chat history tracking
- Async generate function for ReAct agent
- Context window management
- Streaming support
"""

import os
import logging
import asyncio
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from .config import settings
from .file_handler import get_dataframe
from .shared_utils import data_context_builder, text_processor

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for interacting with Google's Gemini models using the new SDK."""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        self.chat_sessions: Dict[str, Any] = {}
        self._history: Dict[str, List[Dict[str, str]]] = {}
        self._client = None

        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
                self.is_configured = True
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.is_configured = False
        else:
            self.is_configured = False
            logger.warning("Gemini API key not configured")

    @property
    def client(self):
        """Expose the genai Client directly for Vanna AI integration."""
        return self._client

    def _get_chat_session(self, session_id: str):
        """Get or create a chat session."""
        if not self.is_configured:
            return None

        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = self._client.chats.create(
                model=self.model_name
            )
            self._history[session_id] = []
        return self.chat_sessions[session_id]

    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get context string for the current data."""
        try:
            df = get_dataframe(session_id, file_id)
            if df is not None:
                return data_context_builder.build_context(df)
            return "No dataset is currently loaded."
        except Exception as e:
            logger.error(f"Error getting data context: {e}")
            return "Error retrieving data context."

    def generate_response(
        self,
        session_id: str,
        user_message: str,
        file_id: Optional[str] = None,
        use_chat_history: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a response from the AI model.

        Args:
            session_id: The session ID
            user_message: The user's question
            file_id: Optional file ID for context
            use_chat_history: Whether to use conversation history

        Returns:
            Dict containing response, code_blocks, etc.
        """
        if not self.is_configured:
            return {"success": False, "error": "AI service not configured"}

        try:
            # Build prompt with data context
            data_context = self.get_data_context(session_id, file_id)

            system_instruction = (
                "You are an expert Data Science Assistant. "
                "Your goal is to help users analyze their data using Python code. "
                "You have access to a pandas DataFrame named 'df'. "
                "When asked to analyze or visualize data, WRITE PYTHON CODE using pandas, matplotlib, or seaborn. "
                "Wrap your code in ```python ... ``` blocks. "
                "The code will be automatically executed and the results shown to the user. "
                "Assume 'df' is already loaded. Do not load data from files. "
                "If the user asks a question that can be answered by looking at the dataframe info provided in context, answer directly. "
                "Otherwise, write code to find the answer. "
                f"\n\nCONTEXT:\n{data_context}"
            )

            full_prompt = f"{system_instruction}\n\nUser Question: {user_message}"

            if use_chat_history:
                chat = self._get_chat_session(session_id)
                response = chat.send_message(full_prompt)
                text_response = response.text
            else:
                response = self._client.models.generate_content(
                    model=self.model_name, contents=full_prompt
                )
                text_response = response.text

            # Track in our explicit history
            if session_id not in self._history:
                self._history[session_id] = []
            self._history[session_id].append(
                {"role": "user", "content": user_message, "has_data": file_id is not None}
            )
            self._history[session_id].append(
                {"role": "assistant", "content": text_response}
            )

            # Keep history manageable (last 50 messages)
            if len(self._history[session_id]) > 50:
                self._history[session_id] = self._history[session_id][-50:]

            # Extract code blocks
            code_blocks = text_processor.extract_code_blocks(text_response)

            return {
                "success": True,
                "response": text_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
            }

        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return {"success": False, "error": str(e)}

    async def generate_async(self, prompt: str, session_id: str) -> str:
        """
        Async generate function designed for the ReAct agent.
        Returns raw text response.

        Args:
            prompt: The full prompt to send
            session_id: Session ID for tracking

        Returns:
            Raw text response from the model
        """
        if not self.is_configured:
            raise RuntimeError("AI service not configured. Set GEMINI_API_KEY.")

        response = await asyncio.to_thread(
            self._client.models.generate_content,
            model=self.model_name,
            contents=prompt,
        )
        return response.text

    async def generate_stream_async(self, prompt: str, session_id: str):
        """
        Async streaming generate function.
        Yields text chunks as they arrive from the Gemini API.

        Args:
            prompt: The full prompt to send
            session_id: Session ID for tracking

        Yields:
            Text chunks from the streaming response
        """
        if not self.is_configured:
            raise RuntimeError("AI service not configured. Set GEMINI_API_KEY.")

        def _stream():
            """Blocking generator for Gemini streaming."""
            response_stream = self._client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

        # Run the blocking generator in a thread and yield chunks
        import queue
        import threading

        q = queue.Queue()
        sentinel = object()

        def _producer():
            try:
                for chunk in _stream():
                    q.put(chunk)
            except Exception as e:
                q.put(e)
            finally:
                q.put(sentinel)

        thread = threading.Thread(target=_producer, daemon=True)
        thread.start()

        while True:
            item = await asyncio.to_thread(q.get)
            if item is sentinel:
                break
            if isinstance(item, Exception):
                raise item
            yield item

    async def _manage_context_window(
        self, session_id: str, max_tokens: int = 4000
    ) -> None:
        """
        Manage context window by summarizing old messages.
        Keeps the last `keep_recent` messages verbatim. 
        Older messages are replaced with a summary.
        """
        history = self._history.get(session_id, [])
        if not history:
            return

        # Estimate tokens (rough: 1 token ≈ 4 chars)
        total_chars = sum(len(m.get("content", "")) for m in history)
        estimated_tokens = total_chars // 4

        if estimated_tokens <= max_tokens:
            return

        keep_recent = 10  # Keep last 10 messages verbatim
        if len(history) <= keep_recent:
            return

        old_messages = history[:-keep_recent]
        recent_messages = history[-keep_recent:]

        # Build a summary of old messages
        old_text = "\n".join(
            f"{m['role']}: {m['content'][:200]}" for m in old_messages
        )

        try:
            summary_prompt = (
                "Summarize the following conversation history concisely, "
                "keeping key facts, data insights, and code results:\n\n"
                + old_text[:3000]
            )
            summary = await self.generate_async(summary_prompt, session_id + "_summary")
            
            self._history[session_id] = [
                {"role": "system", "content": f"[Previous conversation summary]: {summary[:1000]}"}
            ] + recent_messages
        except Exception as e:
            # Fallback: just truncate
            logger.warning(f"Context summarization failed: {e}")
            self._history[session_id] = recent_messages

    def generate_insights(
        self, session_id: str, file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate automatic insights for the dataset."""
        prompt = "Analyze the dataset and provide 3-5 key insights, trends, or interesting patterns. Write python code to visualize these if applicable."
        return self.generate_response(session_id, prompt, file_id, use_chat_history=False)

    def get_chat_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get formatted chat history for a session."""
        return self._history.get(session_id, [])

    def clear_chat_session(self, session_id: str):
        """Clear the chat history and SDK session."""
        if self.is_configured:
            self.chat_sessions[session_id] = self._client.chats.create(
                model=self.model_name
            )
        self._history[session_id] = []


# Singleton instance
gemini_client = GeminiClient()


def get_gemini_client() -> GeminiClient:
    return gemini_client
