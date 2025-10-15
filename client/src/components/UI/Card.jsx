import React from "react";

const Card = ({
  children,
  className = "",
  hover = false,
  padding = "p-6",
  ...props
}) => {
  const baseClasses = "bg-gray-800 rounded-xl border border-gray-700";

  const hoverClass = hover
    ? "transition-all duration-200 hover:border-gray-500 hover:transform hover:scale-105"
    : "";

  const classes = `
    ${baseClasses}
    ${hoverClass}
    ${padding}
    ${className}
  `.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = "" }) => (
  <div className={`border-b border-gray-700 pb-4 mb-4 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h3 className={`text-lg font-bold text-white ${className}`}>{children}</h3>
);

export const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

export const CardFooter = ({ children, className = "" }) => (
  <div className={`border-t border-gray-700 pt-4 mt-4 ${className}`}>
    {children}
  </div>
);

export default Card;
