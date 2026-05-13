-- One-shot rename of bundled program names to neutral, non-trademarked equivalents.
-- Safe on fresh installs (no rows match) and on upgraded installs (in-place rename).
UPDATE `programs` SET `name` = 'Classic 5×5' WHERE `name` = 'StrongLifts 5×5';--> statement-breakpoint
UPDATE `programs` SET `name` = 'Novice Barbell' WHERE `name` = 'Starting Strength';
