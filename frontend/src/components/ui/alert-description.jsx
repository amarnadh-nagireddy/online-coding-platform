import React from 'react';
import { cn } from '@/lib/utils';

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('text-sm', className)}
      {...props}
    />
  );
});

AlertDescription.displayName = 'AlertDescription';

export { AlertDescription };