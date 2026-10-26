-- 선택하지 않은 기존 행은 그대로 두고 표시색은 식별자에서 안정적으로 계산한다(DEC-98).
ALTER TABLE department ADD COLUMN color text
  CHECK (color IN ('teal', 'violet', 'emerald', 'pink', 'sky', 'orange', 'indigo', 'lime'));
