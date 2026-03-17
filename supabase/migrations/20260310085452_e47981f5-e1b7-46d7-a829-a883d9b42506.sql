-- Allow users to UPDATE their own product_intelligence records (inline edits)
CREATE POLICY "Users update own intel"
ON public.product_intelligence
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = product_intelligence.project_id
    AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = product_intelligence.project_id
    AND projects.user_id = auth.uid()
));