
-- scoring_rules: require authenticated session
DROP POLICY IF EXISTS "Anyone can view scoring rules" ON public.scoring_rules;
DROP POLICY IF EXISTS "Anyone can insert scoring rules" ON public.scoring_rules;
DROP POLICY IF EXISTS "Anyone can update scoring rules" ON public.scoring_rules;
DROP POLICY IF EXISTS "Anyone can delete scoring rules" ON public.scoring_rules;

CREATE POLICY "Authenticated users can view scoring rules"
  ON public.scoring_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert scoring rules"
  ON public.scoring_rules FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update scoring rules"
  ON public.scoring_rules FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete scoring rules"
  ON public.scoring_rules FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- filter_rules: require authenticated session
DROP POLICY IF EXISTS "Anyone can view filter rules" ON public.filter_rules;
DROP POLICY IF EXISTS "Anyone can update filter rules" ON public.filter_rules;

CREATE POLICY "Authenticated users can view filter rules"
  ON public.filter_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update filter rules"
  ON public.filter_rules FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- callback_inbox: restrict to service role (edge functions)
DROP POLICY IF EXISTS "System can manage callback inbox" ON public.callback_inbox;

CREATE POLICY "Service role manages callback inbox"
  ON public.callback_inbox FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
