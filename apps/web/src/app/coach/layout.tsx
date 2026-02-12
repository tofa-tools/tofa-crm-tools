// Force dynamic rendering for all coach routes — avoids "location is not defined" during static generation
// Coach pages use auth and router; they must not be pre-rendered at build time
export const dynamic = 'force-dynamic';

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
