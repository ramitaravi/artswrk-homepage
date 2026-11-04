-- Tracks which jobs already have a daily social graphic in Canva.
CREATE TABLE IF NOT EXISTS `job_graphics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `jobId` int NOT NULL,
  `dedupeKey` varchar(191) NOT NULL,
  `status` enum('created','failed') NOT NULL,
  `attempts` int NOT NULL DEFAULT 1,
  `canvaDesignId` varchar(64),
  `lastError` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_graphics_jobId_unique` (`jobId`),
  KEY `job_graphics_dedupeKey_idx` (`dedupeKey`)
);
