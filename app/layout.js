export const metadata = {
  title: "Padel Scorer",
  description: "Score classic padel matches and Americano tournaments",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
