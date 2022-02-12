/**
 * Basically a copy of
 * https://github.com/tbleckert/react-select-search/blob/master/src/SelectSearch.jsx
 * but with react-window.
 * Unfortunately all their autocomplete/<input> management code is in their main class, not the
 * hook so just building my own search from the hook wasn't easy. Or in any case, it would have
 * amounted to reimplementing a lot of things in this class.
 */
import React, {
  forwardRef,
  memo,
  useRef,
  useEffect,
  useCallback,
  FunctionComponent,
} from "react"
import useSelect from "lib/useSelect"
import Option from "react-select-search/dist/cjs/Components/Option"
import isSelected from "react-select-search/dist/cjs/lib/isSelected"

// Not in the original file
import { FixedSizeList } from "react-window"

type WindowSelectSearchProps = {
  value?: any
  disabled?: any
  placeholder?: any
  multiple?: boolean
  search?: boolean
  autoFocus?: any
  autoComplete?: any
  options?: any
  id?: any
  onChange?: any
  printOptions?: any
  closeOnSelect?: any
  className?: any
  renderValue?: any
  renderOption?: any
  renderGroupHeader?: any
  getOptions?: any
  emptyMessage?: any
  fuzzysortOptions?: any
}

const WindowSelectSearch = forwardRef<HTMLDivElement, WindowSelectSearchProps>(
  (
    {
      value: defaultValue,
      disabled,
      placeholder,
      multiple,
      search,
      autoFocus,
      autoComplete,
      options: defaultOptions,
      id,
      onChange,
      printOptions,
      closeOnSelect,
      className,
      renderValue,
      renderOption,
      renderGroupHeader,
      getOptions,
      emptyMessage,
      fuzzysortOptions,
    },
    ref
  ) => {
    const selectRef = useRef<HTMLDivElement>(null)
    const [snapshot, valueProps, optionProps] = useSelect({
      options: defaultOptions,
      value: defaultValue,
      multiple,
      disabled,
      search,
      onChange,
      getOptions,
      closeOnSelect,
      closable: !multiple || printOptions === "on-focus",
      allowEmpty: !!placeholder,
      fuzzysortOptions: fuzzysortOptions,
    })

    const {
      focus,
      highlighted,
      value,
      options,
      searching,
      displayValue,
      search: searchValue,
    } = snapshot

    const cls = useCallback(
      (key) => {
        if (typeof className === "function") {
          return className(key)
        }

        if (key.indexOf("container") === 0) {
          return key.replace("container", className)
        }

        if (key.indexOf("is-") === 0 || key.indexOf("has-") === 0) {
          return key
        }

        return `${className.split(" ")[0]}__${key}`
      },
      [className]
    )

    // const renderEmptyMessage = useCallback(() => {
    //   if (emptyMessage === null) {
    //     return null
    //   }

    //   const content = (typeof emptyMessage === 'function') ? emptyMessage() : emptyMessage

    //   return <li className={cls('not-found')}>{content}</li>
    // }, [emptyMessage, cls])

    const wrapperClass = [
      cls("container"),
      disabled ? cls("is-disabled") : false,
      searching ? cls("is-loading") : false,
      focus ? cls("has-focus") : false,
    ]
      .filter((single) => !!single)
      .join(" ")

    const inputValue = focus && search ? searchValue : displayValue

    useEffect(() => {
      const { current } = selectRef

      if (!current || multiple || (highlighted < 0 && !value)) {
        return
      }

      const query =
        highlighted > -1
          ? `[data-index="${highlighted}"]`
          : `[data-value="${escape(value.value)}"]`
      const selected = current.querySelector<HTMLElement>(query)

      if (selected) {
        const rect = current.getBoundingClientRect()
        const selectedRect = selected.getBoundingClientRect()

        current.scrollTop =
          selected.offsetTop - rect.height / 2 + selectedRect.height / 2
      }
    }, [focus, value, highlighted, selectRef, multiple])

    let shouldRenderOptions

    switch (printOptions) {
      case "never":
        shouldRenderOptions = false
        break
      case "always":
        shouldRenderOptions = true
        break
      case "on-focus":
        shouldRenderOptions = focus
        break
      default:
        shouldRenderOptions = !disabled && (focus || multiple)
        break
    }

    const flattenedOptions = flattenOptions(options)

    const renderItem = function (row) {
      const { index, style } = row
      const option = flattenedOptions[index]
      const isGroup = option.type === "group"
      const base = {
        cls,
        optionProps: Object.assign(optionProps, { style: style }),
        renderOption,
      }

      if (isGroup) {
        return (
          <div key={option.value} className={cls("group-header")} style={style}>
            {renderGroupHeader(option.name)}
          </div>
        )
      } else {
        return (
          <Option
            key={option.value}
            selected={isSelected(option, value)}
            highlighted={highlighted === option.index}
            {...base}
            {...option}
          />
        )
      }
      // if no items, need to return renderEmptyMessage()
    }

    const initialOffset = focus ? 0 : value ? value.index * 36 : 0

    return (
      <div ref={ref} className={wrapperClass} id={id}>
        {(!multiple || placeholder || search) && (
          <div className={cls("value")}>
            {renderValue(
              {
                ...valueProps,
                placeholder,
                autoFocus,
                autoComplete,
                value: inputValue,
              },
              snapshot,
              cls("input")
            )}
          </div>
        )}
        {shouldRenderOptions && (
          <div className={cls("select")} ref={selectRef}>
            <FixedSizeList
              height={360}
              itemCount={flattenedOptions.length}
              itemSize={36}
              initialScrollOffset={initialOffset}
              className={cls("options")}
            >
              {renderItem}
            </FixedSizeList>
          </div>
        )}
      </div>
    )
  }
)

function flattenOptions(options) {
  const output = []
  for (const option of options) {
    if (option.type === "group") {
      const { items, ...header } = option
      output.push(header)
      for (const item of option.items) {
        output.push(item)
      }
    } else {
      output.push(option)
    }
  }

  return output
}

/* eslint-disable */
WindowSelectSearch.defaultProps = {
  className: "select-search",
  disabled: false,
  search: false,
  multiple: false,
  placeholder: null,
  id: null,
  autoFocus: false,
  autoComplete: "on",
  value: "",
  onChange: () => {},
  printOptions: "auto",
  closeOnSelect: true,
  renderOption: (domProps, option, snapshot, className) => (
    <button className={className} {...domProps}>
      {option.name}
    </button>
  ),
  renderGroupHeader: (name) => name,
  renderValue: (valueProps, snapshot, className) => (
    <input {...valueProps} className={className} />
  ),
  getOptions: null,
  emptyMessage: null,
  fuzzysortOptions: { keys: ["name"], threshold: -10000 },
}
/* eslint-enable */

export default memo(WindowSelectSearch)
