-- Universities students can pick at onboarding (P0-03). Idempotent: safe to re-run.
-- staff_email_domain is left empty; it is set per university when lecturer verification (F12) opens.
-- Students at unlisted universities pick "Not listed" and can still learn anything (00 §4.6).
insert into universities (name, short_name)
select v.name, v.short_name
from (values
  ('University of Uyo', 'UNIUYO'),
  ('Akwa Ibom State University', 'AKSU'),
  ('University of Calabar', 'UNICAL'),
  ('University of Lagos', 'UNILAG'),
  ('Lagos State University', 'LASU'),
  ('University of Ibadan', 'UI'),
  ('Obafemi Awolowo University', 'OAU'),
  ('University of Nigeria, Nsukka', 'UNN'),
  ('Nnamdi Azikiwe University', 'UNIZIK'),
  ('University of Benin', 'UNIBEN'),
  ('University of Port Harcourt', 'UNIPORT'),
  ('Rivers State University', 'RSU'),
  ('Ahmadu Bello University', 'ABU'),
  ('Bayero University Kano', 'BUK'),
  ('University of Ilorin', 'UNILORIN'),
  ('University of Jos', 'UNIJOS'),
  ('University of Maiduguri', 'UNIMAID'),
  ('Usmanu Danfodiyo University', 'UDUS'),
  ('Federal University of Technology, Akure', 'FUTA'),
  ('Federal University of Technology, Owerri', 'FUTO'),
  ('Federal University of Technology, Minna', 'FUTMINNA'),
  ('Federal University of Agriculture, Abeokuta', 'FUNAAB'),
  ('Ladoke Akintola University of Technology', 'LAUTECH'),
  ('Olabisi Onabanjo University', 'OOU'),
  ('Ekiti State University', 'EKSU'),
  ('Delta State University', 'DELSU'),
  ('Ambrose Alli University', 'AAU'),
  ('Abia State University', 'ABSU'),
  ('Imo State University', 'IMSU'),
  ('Covenant University', 'CU'),
  ('Babcock University', 'BU'),
  ('Afe Babalola University', 'ABUAD')
) as v(name, short_name)
where not exists (select 1 from universities u where u.short_name = v.short_name);
