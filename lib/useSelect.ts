/**
 * Basically a copy of
 * https://github.com/tbleckert/react-select-search/blob/master/src/useSelect.js
 * but with fuzzysort instead of fuse.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import fuzzysort from "fuzzysort"
import highlightReducer from "react-select-search/dist/cjs/highlightReducer"
import flattenOptions from "react-select-search/dist/cjs/lib/flattenOptions"
import getDisplayValue from "react-select-search/dist/cjs/lib/getDisplayValue"
import getNewValue from "react-select-search/dist/cjs/lib/getNewValue"
import getOption from "react-select-search/dist/cjs/lib/getOption"
import groupOptions from "react-select-search/dist/cjs/lib/groupOptions"

type SelectState = {
  flat: any[]
  addedOptions: any[]
  value: any
  search: string
  focus: boolean
  searching: boolean
  highlighted: number
  changed: false | string[]
}

type ReturnType = [
  {
    value: any
    highlighted: number
    options: any
    disabled: boolean
    displayValue: any
    focus: boolean
    search: string
    searching: boolean
  },
  {
    tabIndex: string
    readOnly: boolean
    onChange: (any) => void
    disabled: boolean
    onMouseDown: (any) => void
    onBlur: (any) => void
    onFocus: (any) => void
    onKeyPress: (any) => void
    onKeyDown: (any) => void
    onKeyUp: (any) => void
    ref: any
  },
  {
    tabIndex: string
    onMouseDown: (any) => void
    onKeyDown: (any) => void
    onKeyPress: (any) => void
    onBlur: (any) => void
  },
  (any) => void
]

export default function useSelect({
  value: defaultValue = null,
  disabled = false,
  multiple = false,
  search: canSearch = false,
  options: defaultOptions,
  fuzzysortOptions = { keys: ["name"], threshold: -10000 },
  onChange = function () {
    /* do nothing */
  },
  getOptions = null,
  allowEmpty = true,
  closeOnSelect = true,
  closable = true,
}): ReturnType {
  const ref = useRef(null)
  const flatDefaultOptions = useMemo(
    () => flattenOptions(defaultOptions),
    [defaultOptions]
  )
  const [state, setState] = useState<SelectState>({
    flat: [],
    addedOptions: [],
    value: defaultValue,
    search: "",
    focus: false,
    searching: false,
    highlighted: -1,
    changed: false,
  })

  const { flat, addedOptions, value, search, focus, searching, highlighted } =
    state

  const option = useMemo(() => {
    let newOption = getOption(value, [...flatDefaultOptions, ...addedOptions])

    if (!newOption && !allowEmpty && !multiple) {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;[newOption] = flatDefaultOptions
    }

    return newOption
  }, [value, flatDefaultOptions, addedOptions, allowEmpty, multiple])
  const options = useMemo(() => groupOptions(flat), [flat])
  const displayValue = useMemo(() => getDisplayValue(option), [option])
  const onBlur = useCallback(() => {
    setState((oldState) => ({
      ...oldState,
      focus: false,
      search: "",
      flat: flatDefaultOptions,
      highlighted: -1,
    }))

    if (ref.current) {
      ref.current.blur()
    }
  }, [flatDefaultOptions, ref])

  const setFocus = (newFocus) =>
    setState((oldState) => ({ ...oldState, focus: newFocus }))
  const onClick = () => setFocus(!focus)
  const onFocus = () => setFocus(true)
  const onSelect = useCallback(
    (id?: number) => {
      setState((prevState) => {
        const { flat: prevFlat, highlighted: prevHighlighted } = prevState
        // eslint-disable-next-line no-underscore-dangle,eqeqeq
        const item = id
          ? prevFlat.find((i) => i.value == id)
          : prevFlat[prevHighlighted]
        if (!item) {
          return prevState
        }

        const values = getNewValue(item.value, prevState.value, multiple)
        const newOptions = getOption(values, prevFlat)

        return {
          ...prevState,
          addedOptions: multiple ? newOptions : [newOptions],
          value: values,
          changed: [values, newOptions],
        }
      })
    },
    [multiple]
  )

  const onMouseDown = useCallback(
    (e) => {
      if (!closeOnSelect) {
        e.preventDefault()
      }
      onSelect(e.currentTarget.value)
    },
    [onSelect, closeOnSelect]
  )

  const onKeyDown = useCallback((e) => {
    const { key } = e

    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault()

      setState((oldState) => ({
        ...oldState,
        highlighted: highlightReducer(oldState.highlighted, {
          key,
          options: oldState.flat,
        }),
      }))
    }
  }, [])

  const onKeyPress = useCallback(
    ({ key }) => {
      if (key === "Enter") {
        onSelect()

        if (closable && closeOnSelect) {
          onBlur()
        }
      }
    },
    [onSelect, closeOnSelect, onBlur, closable]
  )

  const onKeyUp = useCallback(
    ({ key }) => {
      if (key === "Escape") {
        onBlur()
      }
    },
    [onBlur]
  )

  const onSearch = ({ target }) => {
    const { value: inputVal } = target
    const newState: Partial<SelectState> = { search: inputVal }

    let searchableOption = flatDefaultOptions

    if (getOptions && inputVal.length) {
      newState.searching = true

      searchableOption = getOptions(inputVal)
    }

    setState((oldState) => ({ ...oldState, ...newState }))

    Promise.resolve(searchableOption)
      .then((foundOptions) => {
        let newOptions = foundOptions

        if (inputVal.length) {
          newOptions = fuzzysort
            .go(inputVal, foundOptions, fuzzysortOptions)
            .map((result: any) => result.obj)
        }

        setState((oldState) => ({
          ...oldState,
          flat: newOptions === false ? foundOptions : newOptions,
          searching: false,
        }))
      })
      .catch(() =>
        setState((oldState) => ({
          ...oldState,
          flat: flatDefaultOptions,
          searching: false,
        }))
      )
  }

  const valueProps = {
    tabIndex: "0",
    readOnly: !canSearch,
    onChange: canSearch ? onSearch : null,
    disabled,
    onMouseDown: onClick,
    onBlur,
    onFocus,
    onKeyPress,
    onKeyDown,
    onKeyUp,
    ref,
  }

  const optionProps = useMemo(
    () => ({
      tabIndex: "-1",
      onMouseDown,
      onKeyDown,
      onKeyPress,
      onBlur,
    }),
    [onMouseDown, onKeyDown, onKeyPress, onBlur]
  )

  useEffect(() => {
    setState((oldState) => ({ ...oldState, value: defaultValue }))
  }, [defaultValue])

  useEffect(() => {
    setState((oldState) => ({ ...oldState, flat: flatDefaultOptions }))
  }, [flatDefaultOptions])

  useEffect(() => {
    if (state.changed !== false) {
      // No idea why I'm getting type errors here, TODO fix it
      setState((oldState) => ({ ...oldState, changed: false }))
      // eslint-disable-next-line prefer-spread
      onChange.apply(null, state.changed)
    }
  }, [state.changed, onChange])

  return [
    {
      value: option,
      highlighted,
      options,
      disabled,
      displayValue,
      focus,
      search,
      searching,
    },
    valueProps,
    optionProps,
    (newValue) => setState((oldState) => ({ ...oldState, value: newValue })),
  ]
}
