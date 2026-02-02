export const metadata = {
  title: 'Visualization Studio - Data Science Platform',
  description: 'Create stunning interactive charts and visualizations from your data',
}

export default function VisualizationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="visualization-layout min-h-screen bg-[var(--bg-secondary)]">
      {children}
    </div>
  )
}
