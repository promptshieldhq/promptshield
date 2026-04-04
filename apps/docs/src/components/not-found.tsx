import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center gap-4 p-8">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-fd-muted-foreground max-w-sm text-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-3 mt-2">
        <Link
          to="/docs/$"
          params={{ _splat: '' }}
          className="px-4 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm"
        >
          Go to Docs
        </Link>
      </div>
    </div>
  );
}
