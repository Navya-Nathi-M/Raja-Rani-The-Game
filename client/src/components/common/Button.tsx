import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
}
export const Button = ({ onClick, children }: ButtonProps) => (
  <button onClick={onClick} className="px-4 py-2 bg-blue-500 text-white rounded">
    {children}
  </button>
);