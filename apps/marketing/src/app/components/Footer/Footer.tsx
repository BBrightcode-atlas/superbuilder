"use client";

import { COMPANY } from "@superset/shared/constants";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SocialLinks } from "../SocialLinks";

function SuperBuilderLogo() {
	return (
		<img
			src="/assets/logo-full.png"
			alt="SuperBuilder"
			width={98}
			height={16}
		/>
	);
}

export function Footer() {
	return (
		<footer className="border-t border-border bg-background">
			<motion.div
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-14"
			>
				{/* Main footer content */}
				<div className="flex flex-col sm:flex-row justify-between items-start gap-8">
					{/* Left side - Logo and legal links */}
					<div className="space-y-5">
						<Link
							href="/"
							className="text-muted-foreground hover:text-foreground transition-colors inline-block"
						>
							<SuperBuilderLogo />
						</Link>
						<nav className="flex items-center gap-6 text-sm">
							<a
								href={COMPANY.DOCS_URL}
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								Docs
							</a>
							<Link
								href="/team"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								About
							</Link>
							<Link
								href="/privacy"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								Privacy
							</Link>
							<Link
								href="/terms"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								Terms
							</Link>
							<a
								href="https://statuspage.incident.io/superset"
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
							>
								Status
								<ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
							</a>
						</nav>
					</div>

					{/* Right side - Social links */}
					<SocialLinks />
				</div>

				{/* Bottom - Copyright */}
				<div className="mt-10 pt-6 border-t border-border/60">
					<p className="text-muted-foreground text-sm">
						© {new Date().getFullYear()} SuperBuilder Inc. All rights reserved.
					</p>
				</div>
			</motion.div>
		</footer>
	);
}
