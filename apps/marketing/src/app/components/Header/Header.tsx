"use client";

import { COMPANY } from "@superset/shared/constants";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function SuperBuilderLogo() {
	return (
		<img
			src="/assets/logo-full.png"
			alt="SuperBuilder"
			className="h-5 w-auto"
		/>
	);
}

const NAV_LINKS = [
	{ href: COMPANY.DOCS_URL, label: "Docs", external: true },
	{ href: "/changelog", label: "Changelog", external: false },
	{ href: "/blog", label: "Blog", external: false },
	{ href: "/team", label: "About", external: false },
	{ href: "/community", label: "Community", external: false },
];

interface HeaderProps {
	ctaButtons: React.ReactNode;
	starCounter?: React.ReactNode;
}

export function Header({ ctaButtons, starCounter }: HeaderProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-14">
					{/* Logo */}
					<motion.a
						href="/"
						className="flex items-center text-foreground hover:text-foreground/80 transition-colors"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.3 }}
					>
						<SuperBuilderLogo />
					</motion.a>

					{/* Desktop Navigation */}
					<motion.div
						className="hidden md:flex items-center"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.3, delay: 0.1 }}
					>
						<nav className="flex items-center">
							{NAV_LINKS.map((link, index) => (
								<div key={link.href} className="flex items-center">
									{index > 0 && <div className="h-4 w-px bg-border mx-1" />}
									{link.external ? (
										<a
											href={link.href}
											className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
										>
											{link.label}
										</a>
									) : (
										<Link
											href={link.href}
											className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
										>
											{link.label}
										</Link>
									)}
								</div>
							))}
							<div className="h-4 w-px bg-border mx-1" />
							{starCounter}
						</nav>
						<div className="flex items-center gap-2 ml-4">{ctaButtons}</div>
					</motion.div>

					{/* Mobile: Hamburger button */}
					<motion.button
						type="button"
						className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						aria-label={isMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={isMenuOpen}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.3, delay: 0.1 }}
					>
						{isMenuOpen ? (
							<X className="size-5" />
						) : (
							<Menu className="size-5" />
						)}
					</motion.button>
				</div>

				{/* Mobile menu */}
				<AnimatePresence>
					{isMenuOpen && (
						<motion.div
							className="md:hidden border-t border-border"
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.2 }}
						>
							<div className="py-4 flex flex-col gap-1">
								{NAV_LINKS.map((link) =>
									link.external ? (
										<a
											key={link.href}
											href={link.href}
											className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
										>
											{link.label}
										</a>
									) : (
										<Link
											key={link.href}
											href={link.href}
											className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
											onClick={() => setIsMenuOpen(false)}
										>
											{link.label}
										</Link>
									),
								)}
								<div className="px-2 py-2">{starCounter}</div>
								<div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border">
									{ctaButtons}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</header>
	);
}
