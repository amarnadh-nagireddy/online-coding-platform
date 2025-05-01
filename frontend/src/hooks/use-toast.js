import { useState, useEffect } from 'react';

// Generate a unique ID for each toast
const generateId = () => {
  return Math.random().toString(36).substring(2, 9);
};

export function useToast() {
  const [toasts, setToasts] = useState([]);

  // Clean up toasts after they expire
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts((prevToasts) => 
        prevToasts.filter((toast) => !toast.autoClose || Date.now() < toast.expiry)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function toast(options) {
    const id = options?.id || generateId();
    const autoClose = options?.autoClose !== false;
    const duration = options?.duration || 5000; // Default to 5 seconds
    
    // If a toast with this ID already exists, update it instead of creating a new one
    setToasts((prevToasts) => {
      const existingToastIndex = prevToasts.findIndex((t) => t.id === id);
      
      const newToast = {
        id,
        title: options?.title,
        description: options?.description,
        action: options?.action,
        variant: options?.variant || "default",
        autoClose,
        expiry: autoClose ? Date.now() + duration : null,
      };

      if (existingToastIndex !== -1) {
        const updatedToasts = [...prevToasts];
        updatedToasts[existingToastIndex] = newToast;
        return updatedToasts;
      }

      return [...prevToasts, newToast];
    });

    return {
      id,
      dismiss: () => dismissToast(id),
      update: (options) => updateToast(id, options),
    };
  }

  function dismissToast(id) {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }

  function updateToast(id, options) {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id
          ? {
              ...toast,
              ...options,
              expiry: options.autoClose !== undefined
                ? options.autoClose
                  ? Date.now() + (options.duration || 5000)
                  : null
                : toast.expiry,
            }
          : toast
      )
    );
  }

  return {
    toast,
    toasts,
    dismissToast,
  };
}
