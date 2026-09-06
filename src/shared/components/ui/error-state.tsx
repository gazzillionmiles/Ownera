import { AlertCircle } from "lucide-react";
import { cn } from "@/src/shared/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({ 
  title = "Something went wrong", 
  description, 
  action, 
  className 
}: ErrorStateProps) {
  return (
    <div className={cn("error-state", className)}>
      <AlertCircle className="h-12 w-12" />
      <h3 className="h4 text-destructive-foreground">{title}</h3>
      {description && <p className="body-sm max-w-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
