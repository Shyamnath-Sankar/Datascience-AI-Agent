export const metadata = {
  title: 'Data Profile - Data Science Platform',
  description: 'Data profiling and analysis for your datasets',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="profile-layout">
      {children}
    </div>
  )
}
