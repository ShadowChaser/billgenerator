"use client";
import { motion } from "framer-motion";
import Link from "next/link";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ href: string; label: string }>;
  isActive: (href: string) => boolean;
  linkClass: (href: string) => string;
  itemVariants: any;
}

export function MobileMenu({ isOpen, onClose, items, isActive, linkClass, itemVariants }: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <button
        aria-label="Close navigation menu"
        className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        onClick={onClose}
      />

      {/* Mobile menu */}
      <motion.nav
        className="fixed top-14 sm:top-auto left-0 right-0 z-50 sm:static sm:z-auto bg-background sm:bg-transparent border-t border-black/10 dark:border-white/10 sm:border-0 p-4 sm:p-0 flex flex-col sm:flex-row gap-2 sm:gap-2"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.06, delayChildren: 0.1 },
          },
        }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onClose} className={linkClass(item.href)}>
              {/* Animated gradient sweep for active */}
              {active && (
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(59,130,246,0.7) 0%, rgba(45,212,191,0.7) 50%, rgba(99,102,241,0.7) 100%)",
                    backgroundSize: "250% 100%",
                    filter: "saturate(105%)",
                  }}
                  animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
                  transition={{ duration: 3.2, ease: "linear", repeat: Infinity }}
                />
              )}
              <motion.span
                variants={itemVariants}
                whileHover={{ y: -1, scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="inline-flex items-center relative z-10"
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}
      </motion.nav>
    </>
  );
}
