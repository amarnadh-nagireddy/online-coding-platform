import React from 'react';
import { cn } from '@/lib/utils'; // Assuming a utility for classNames, common in Shadcn-like setups

// Forward ref to allow the component to accept a ref (useful for focus management)
const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

// Set display name for better debugging
Input.displayName = 'Input';

export { Input };