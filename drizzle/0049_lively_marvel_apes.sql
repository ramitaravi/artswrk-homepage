ALTER TABLE `users` ADD `planTier` enum('artist_free','artist_basic','artist_pro','client_on_demand','client_premium','enterprise_on_demand','enterprise_subscription');--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `stripePriceId` varchar(64);