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
  useCallback
} from 'react'
// import { useSelect } from 'react-select-search/dist/cjs'
// import { useSelect } from './useSelect.js'
import useSelect from './useSelect.js'
import Option from 'react-select-search/dist/cjs/Components/Option'
import isSelected from 'react-select-search/dist/cjs/lib/isSelected'

// Not in the original file
import { FixedSizeList } from 'react-window'
console.log(useSelect)

const WindowSelectSearch = forwardRef(({
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
  fuse,
  emptyMessage
}, ref) => {
  const selectRef = useRef(null)
  const [snapshot, valueProps, optionProps] = useSelect({
    options: defaultOptions,
    value: defaultValue,
    multiple,
    disabled,
    fuse,
    search,
    onChange,
    getOptions,
    closeOnSelect,
    closable: !multiple || printOptions === 'on-focus',
    allowEmpty: !!placeholder
  })

  const {
    focus,
    highlighted,
    value,
    options,
    searching,
    displayValue,
    search: searchValue
  } = snapshot

  const cls = useCallback((key) => {
    if (typeof className === 'function') {
      return className(key)
    }

    if (key.indexOf('container') === 0) {
      return key.replace('container', className)
    }

    if (key.indexOf('is-') === 0 || key.indexOf('has-') === 0) {
      return key
    }

    return `${className.split(' ')[0]}__${key}`
  }, [className])

  // const renderEmptyMessage = useCallback(() => {
  //   if (emptyMessage === null) {
  //     return null
  //   }

  //   const content = (typeof emptyMessage === 'function') ? emptyMessage() : emptyMessage

  //   return <li className={cls('not-found')}>{content}</li>
  // }, [emptyMessage, cls])

  const wrapperClass = [
    cls('container'),
    (disabled) ? cls('is-disabled') : false,
    (searching) ? cls('is-loading') : false,
    (focus) ? cls('has-focus') : false
  ].filter((single) => !!single).join(' ')

  const inputValue = (focus && search) ? searchValue : displayValue

  useEffect(() => {
    const { current } = selectRef

    if (!current || multiple || (highlighted < 0 && !value)) {
      return
    }

    const query = (highlighted > -1) ? `[data-index="${highlighted}"]` : `[data-value="${escape(value.value)}"]`
    const selected = current.querySelector(query)

    if (selected) {
      const rect = current.getBoundingClientRect()
      const selectedRect = selected.getBoundingClientRect()

      current.scrollTop = selected.offsetTop - (rect.height / 2) + (selectedRect.height / 2)
    }
  }, [focus, value, highlighted, selectRef, multiple])

  let shouldRenderOptions

  switch (printOptions) {
    case 'never':
      shouldRenderOptions = false
      break
    case 'always':
      shouldRenderOptions = true
      break
    case 'on-focus':
      shouldRenderOptions = focus
      break
    default:
      shouldRenderOptions = !disabled && (focus || multiple)
      break
  }

  const renderItem = function (row) {
    const { index, style } = row
    const option = options[index]
    const isGroup = option.type === 'group'
    const items = (isGroup) ? option.items : [option]
    const base = { cls, optionProps: Object.assign(optionProps, { style: style }), renderOption }
    // console.log(base)
    // console.log(option)
    const rendered = items.map((o) => (
      <Option
        key={o.value}
        selected={isSelected(o, value)}
        highlighted={highlighted === o.index}
        {...base}
        {...o}
      />
    ))

    if (isGroup) {
      return (
        <li role='none' className={cls('row')} key={option.groupId}>
          <div className={cls('group')}>
            <div className={cls('group-header')}>{renderGroupHeader(option.name)}</div>
            <ul className={cls('options')}>
              {rendered}
            </ul>
          </div>
        </li>
      )
    }

    return rendered
    // if no items, need to return
    // renderEmptyMessage()
  }

  const initialOffset = focus ? 0 : (value ? value.index * 36 : 0)

  return (
    <div ref={ref} className={wrapperClass} id={id}>
      {((!multiple || placeholder) || search) && (
        <div className={cls('value')}>
          {renderValue(
            {
              ...valueProps,
              placeholder,
              autoFocus,
              autoComplete,
              value: inputValue
            },
            snapshot,
            cls('input')
          )}
        </div>
      )}
      {shouldRenderOptions && (
        <div className={cls('select')} ref={selectRef}>
          <FixedSizeList
            height={360}
            itemCount={options.length}
            itemSize={36}
            initialScrollOffset={initialOffset}
            className={cls('options')}
          >
            {renderItem}
          </FixedSizeList>
        </div>
      )}
    </div>
  )
})

WindowSelectSearch.defaultProps = {
  className: 'select-search',
  disabled: false,
  search: false,
  multiple: false,
  placeholder: null,
  id: null,
  autoFocus: false,
  autoComplete: 'on',
  value: '',
  onChange: () => {},
  printOptions: 'auto',
  closeOnSelect: true,
  renderOption: (domProps, option, snapshot, className) => (
    // eslint-disable-next-line react/button-has-type
    <button className={className} {...domProps}>
      {option.name}
    </button>
  ),
  renderGroupHeader: (name) => name,
  renderValue: (valueProps, snapshot, className) => (
    <input
      {...valueProps}
      className={className}
    />
  ),
  fuse: {
    keys: ['name', 'groupName'],
    threshold: 0.3
  },
  getOptions: null,
  emptyMessage: null
}

export default memo(WindowSelectSearch)
