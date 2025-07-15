export default function RootLayout({
  children,
}: {
  children: React.ReactNode //形式的なものらしい　何書いてあるかわからん
}) {
  return (
    <html lang="en"> 
      <body>{children}</body>
    </html>
  )
}