-- Make embedding generation optional for local development
-- This allows expert profiles to be created without requiring an OpenAI API key

-- Update the call_openai_embeddings_api function to return NULL instead of raising an exception
-- when the API key is not found (for local development)
CREATE OR REPLACE FUNCTION call_openai_embeddings_api(input_text TEXT)
RETURNS float[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  api_key TEXT;
  api_response http_response;
  embedding_array float[];
BEGIN
  -- Get OpenAI API key from vault
  SELECT decrypted_secret INTO api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'openai_api_key';
  
  -- If no API key found, return NULL instead of raising exception
  -- This allows local development without requiring OpenAI setup
  IF api_key IS NULL THEN
    RAISE WARNING 'OpenAI API key not found in vault - skipping embedding generation';
    RETURN NULL;
  END IF;
  
  -- Set connection and request timeouts to 30 seconds
  PERFORM set_config('http.curlopt_connecttimeout', '30', false);
  PERFORM set_config('http.curlopt_timeout', '30', false);
  
  -- Call OpenAI Embeddings API
  SELECT * INTO api_response FROM http((
    'POST',
    'https://api.openai.com/v1/embeddings',
    ARRAY[
      http_header('Authorization', 'Bearer ' || api_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'model', 'text-embedding-3-small',
      'input', input_text
    )::text
  )::http_request);
  
  IF api_response.status = 200 THEN
    SELECT ARRAY(
      SELECT json_array_elements_text(
        (api_response.content::json->'data'->0->'embedding')::json
      )::float
    ) INTO embedding_array;
    
    RETURN embedding_array;
  ELSE
    RAISE WARNING 'OpenAI API error: % % - skipping embedding generation', api_response.status, api_response.content;
    RETURN NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION call_openai_embeddings_api IS 'Helper function to call OpenAI embeddings API. Returns NULL if API key is not configured (for local development).';

