import useFetch from "use-http";

export function useStateData() {
  /**
   * Usage:
   * const [request, response] = useStateData();
   */
  return useFetch(
    "/state_annual.json",
    { data: [] }, // Default value, until the data is loaded.
    []
  );
}
