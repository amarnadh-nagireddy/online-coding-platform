import React from 'react';
import { cn } from '@/lib/utils';

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="radiogroup"
      className={cn('space-y-2', className)}
      {...props}
    />
  );
});

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };