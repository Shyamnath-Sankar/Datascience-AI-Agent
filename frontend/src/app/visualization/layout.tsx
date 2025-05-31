export const metadata = {
  title: 'Data Visualization - Data Science Platform',
  description: 'Visualize and explore your datasets',
}

export default function VisualizationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="visualization-layout">
      {children}
    </div>
  )
}
