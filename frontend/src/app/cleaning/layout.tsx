export const metadata = {
  title: 'Data Cleaning - Data Science Platform',
  description: 'Clean and preprocess your datasets',
}

export default function CleaningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="cleaning-layout">
      {children}
    </div>
  )
}
