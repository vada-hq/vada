ALTER TABLE member
  ADD COLUMN school_name text,
  ADD COLUMN college_name text,
  ADD COLUMN major_name text,
  ADD COLUMN grade integer;
--> statement-breakpoint
ALTER TABLE member
  ADD CHECK (school_name IS NULL OR char_length(school_name) <= 50),
  ADD CHECK (college_name IS NULL OR char_length(college_name) <= 50),
  ADD CHECK (major_name IS NULL OR char_length(major_name) <= 50),
  ADD CHECK (grade IS NULL OR grade BETWEEN 1 AND 6);
