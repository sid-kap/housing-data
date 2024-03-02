import { useQuery } from "react-query"

export function useFetch(url) {
  return useQuery({
    queryKey: url,
    queryFn: () => {
      if (url) {
        return fetch(url).then((res) => res.json())
      } else {
        return []
      }
    },
    staleTime: Infinity,
  })
}
