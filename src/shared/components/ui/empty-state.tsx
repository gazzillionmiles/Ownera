import { cn } from "@/src/shared/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {icon && <div className="mb-4 text-4xl opacity-60">{icon}</div>}
      <h3 className="h4 mb-2 text-foreground">{title}</h3>
      {description && <p className="body-sm max-w-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
