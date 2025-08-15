import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={
        "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm " +
        className
      }
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className = "", ...props }: CardProps) => (
  <div className={"p-6 border-b border-gray-100 dark:border-gray-700 " + className} {...props} />
);
export const CardTitle = ({ className = "", ...props }: CardProps) => (
  <h3 className={"text-xl font-bold leading-none tracking-tight " + className} {...props} />
);
export const CardDescription = ({ className = "", ...props }: CardProps) => (
  <p className={"text-sm text-gray-600 dark:text-gray-300 " + className} {...props} />
);
export const CardContent = ({ className = "", ...props }: CardProps) => (
  <div className={"p-6 " + className} {...props} />
);
export const CardFooter = ({ className = "", ...props }: CardProps) => (
  <div className={"p-6 pt-0 " + className} {...props} />
);

export default Card;
