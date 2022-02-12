import { useQuery } from "react-query"

export function useFetch(url) {
  return useQuery(
    url,
    /* eslint-disable */
    () => fetch(url).then((res) => res.json()),
    /* eslint-enable */
    { staleTime: Infinity }
  )
}
