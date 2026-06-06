import { Profile } from '@/types';

const mockUser: Profile = {
  id: '123',
  first_name: 'Jorge',
  last_name: 'R',
  email: 'jorge@example.com',
  role: 'admin',
  congregation_id: 'cong-abc'
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8 text-blue-600">
          Meeting Scheduler Pro 🚀
        </h1>
        <div className="p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            System Ready: Welcome, {mockUser.first_name}!
          </h2>
          <p className="text-muted-foreground">
            Role: <span className="font-bold uppercase text-blue-500">{mockUser.role}</span> | 
            Congregation ID: <span className="italic">{mockUser.congregation_id}</span>
          </p>
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-400 italic">
              Architecture initialized successfully. All modules pending.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
