import { useCallback, useEffect, useState } from 'react'
import api, { apiError } from '../api/client'

/* Fetch `url` on mount; expose data, loading, error and a reload() to refetch. */
export function useFetch(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    return api
      .get(url)
      .then((r) => {
        setData(r.data)
        setError('')
      })
      .catch((e) => setError(apiError(e, 'Failed to load')))
      .finally(() => setLoading(false))
  }, [url])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}
