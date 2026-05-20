-- AI Verdict v2 generated detail fields.
-- Existing rows stay readable with nullable columns; new prompt/schema v2 rows require these in the Edge Function.

alter table public.ai_case_verdicts
  add column if not exists display_label text,
  add column if not exists evidence_check_text text,
  add column if not exists overreading_text text,
  add column if not exists what_matters_text text;

alter table public.ai_guest_case_verdicts
  add column if not exists display_label text,
  add column if not exists evidence_check_text text,
  add column if not exists overreading_text text,
  add column if not exists what_matters_text text;

do $$ begin
  alter table public.ai_case_verdicts
    add constraint ai_case_verdicts_display_label_not_blank
    check (display_label is null or length(trim(display_label)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_case_verdicts
    add constraint ai_case_verdicts_evidence_check_not_blank
    check (evidence_check_text is null or length(trim(evidence_check_text)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_case_verdicts
    add constraint ai_case_verdicts_overreading_not_blank
    check (overreading_text is null or length(trim(overreading_text)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_case_verdicts
    add constraint ai_case_verdicts_what_matters_not_blank
    check (what_matters_text is null or length(trim(what_matters_text)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_guest_case_verdicts
    add constraint ai_guest_case_verdicts_display_label_not_blank
    check (display_label is null or length(trim(display_label)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_guest_case_verdicts
    add constraint ai_guest_case_verdicts_evidence_check_not_blank
    check (evidence_check_text is null or length(trim(evidence_check_text)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_guest_case_verdicts
    add constraint ai_guest_case_verdicts_overreading_not_blank
    check (overreading_text is null or length(trim(overreading_text)) > 0);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.ai_guest_case_verdicts
    add constraint ai_guest_case_verdicts_what_matters_not_blank
    check (what_matters_text is null or length(trim(what_matters_text)) > 0);
exception
  when duplicate_object then null;
end $$;
