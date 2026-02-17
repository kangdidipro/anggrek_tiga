import { Soup } from 'lucide-react';
import Cart from '@/components/cart';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <Soup className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block font-headline text-lg">
              TakjilKu
            </span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end">
          <Cart />
        </div>
      </div>
    </header>
  );
}
