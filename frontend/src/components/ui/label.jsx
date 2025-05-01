import React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef(({ className, htmlFor, ...props }, ref) => {
  return (
    <label
      htmlFor={htmlFor}
      ref={ref}
      className={cn(
        'text-sm font-medium text-gray-700',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  );
});

Label.displayName = 'Label';

export { Label };