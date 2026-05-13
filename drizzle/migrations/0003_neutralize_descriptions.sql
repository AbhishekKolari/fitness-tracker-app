-- Replace the previous "Mark Rippetoe's barbell novice program..." wording on
-- the renamed "Novice Barbell" program with a neutral description, matching
-- the current seed file. Safe on fresh installs (no matching rows).
UPDATE `programs`
SET `description` = 'Classic barbell novice program. Three big compound lifts per session, 3 days a week, adding weight every workout.'
WHERE `name` = 'Novice Barbell'
  AND `description` LIKE 'Mark Rippetoe%';
