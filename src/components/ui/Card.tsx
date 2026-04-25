import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Card = ({ 
  className = '', 
  children, 
  header, 
  footer 
}: CardProps) => {
  return (
    <div className={`mono-card ${className}`}>
      {header && <div className="mono-card-header pb-4">{header}</div>}
      <div className="mono-card-body">{children}</div>
      {footer && <div className="mono-card-footer pt-4">{footer}</div>}
    </div>
  );
};

export default Card;