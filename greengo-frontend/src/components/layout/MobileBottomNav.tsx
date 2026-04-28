// src/components/layout/MobileBottomNav.tsx
import { NavLink } from "react-router-dom";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { useCartStore } from "../../store/cartStore";

interface NavItem {
  to:          string;
  icon:        React.ReactNode;
  label:       string;
  badgeCount?: number;
}

export default function MobileBottomNav() {
  const cart       = useCartStore((s) => s.cart);
  const totalItems = cart.reduce((sum, item) => sum + (item.cartQuantity || 0), 0);

  const navItems: NavItem[] = [
    {
      to:    "/",
      icon:  <Home size={22} strokeWidth={2} />,
      label: "Accueil",
    },
    {
      to:    "/shop",
      icon:  <LayoutGrid size={22} strokeWidth={2} />,
      label: "Catalogue",
    },
    {
      to:         "/cart",
      icon:       <ShoppingCart size={22} strokeWidth={2} />,
      label:      "Panier",
      badgeCount: totalItems,
    },
    {
      to:    "/profile/user",
      icon:  <User size={22} strokeWidth={2} />,
      label: "Compte",
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <ul className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 w-full",
                  "transition-colors duration-150 select-none",
                  isActive ? "text-[#2E8B57]" : "text-gray-400 hover:text-gray-600",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    {item.icon}
                    {item.badgeCount != null && item.badgeCount > 0 && (
                      <span
                        className="absolute -top-2 -left-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[10px] font-extrabold text-white shadow"
                        style={{ backgroundColor: "#FF9800" }}
                      >
                        {item.badgeCount > 99 ? "99+" : item.badgeCount}
                      </span>
                    )}
                  </span>

                  <span
                    className={[
                      "text-[10px] font-semibold leading-none",
                      isActive ? "text-[#2E8B57]" : "text-gray-400",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>

                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-[#2E8B57]" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}