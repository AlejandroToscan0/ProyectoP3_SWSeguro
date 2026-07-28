import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { ModuleNavItem } from "../menu/treeUtils";

type ModuleWorkspaceProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  items: ModuleNavItem[];
  children: ReactNode;
  footer?: ReactNode;
};

export function ModuleWorkspace({
  eyebrow = "Módulo",
  title,
  description,
  items,
  children,
  footer,
}: ModuleWorkspaceProps) {
  const showTabs = items.length > 1;

  return (
    <section className="module-workspace panel panel-wide">
      <header className="module-workspace-head">
        <div className="module-workspace-copy">
          <p className="module-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p className="muted module-lead">{description}</p> : null}
        </div>
      </header>

      {showTabs ? (
        <nav className="module-tabs" aria-label="Apartados del módulo">
          {items.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end
              className={({ isActive }) => (isActive ? "module-tab active" : "module-tab")}
            >
              {item.nombre}
            </NavLink>
          ))}
        </nav>
      ) : null}

      <div className="module-workspace-body">{children}</div>

      {footer ? <footer className="module-workspace-footer">{footer}</footer> : null}
    </section>
  );
}
