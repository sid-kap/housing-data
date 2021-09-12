import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { FixedSizeList } from 'react-window'
import { OrderedMap } from 'immutable'
import fuzzysort from 'fuzzysort'

export default function MultiSelect ({ options, groupOptions, onChange, itemClassFn }) {
  const [isTyping, setIsTyping] = useState<boolean>(false)

  const [selectedItems, setSelectedItems] = useState(OrderedMap())
  useEffect(() => onChange(selectedItems), [selectedItems])

  const inputRef = useRef()
  const listRef = useRef()
  const [input, setInput] = useState<string>('')

  /* console.log(selectedItems.toArray()) */

  // TODO: Figure out how to add the group titles. For now, this is fine.
  const allOptions = useMemo(() => {
    // OrderedMap to preserve the order of the options from the JSON files
    return options.concat(groupOptions.flatMap((ops) => ops.items))
  }, [options])

  const allOptionsMap = useMemo(() => {
    return OrderedMap(allOptions.map((item) => [item.value, item]))
  }, [allOptions])

  const filteredOptions = useMemo(() => {
    let filtered = allOptions.filter((item) => !selectedItems.has(item.value))
    if (input.length > 0) {
      filtered = fuzzysort.go(input, filtered, { keys: ['name'], threshold: -10000 }).map((result) => result.obj)
    }
    return filtered
  }, [input, allOptions, selectedItems])

  const [highlightIndex, setHighlightIndex] = useState(null)

  const ensureItemInView = useCallback((index) => {
    // There should be a better way to get around this TypeScript error...
    (listRef.current as any).scrollToItem(index)
  }, [listRef])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()

      setHighlightIndex((idx) => {
        if (idx == null) {
          return 0
        } else if (idx > 0) {
          ensureItemInView(idx - 1)
          return idx - 1
        } else {
          return idx
        }
      })
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()

      setHighlightIndex((idx) => {
        if (idx == null) {
          return 0
        } else if (idx < filteredOptions.length - 1) {
          ensureItemInView(idx + 1)
          return idx + 1
        } else {
          return idx
        }
      })
    }
  }, [filteredOptions])

  const onKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = filteredOptions[highlightIndex]
      toggleValue(item)
    }
  }, [filteredOptions, highlightIndex])

  const onKeyUp = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      (inputRef.current as any).blur()
    }
  }, [inputRef])

  // const optionValueToName = useMemo(() => {
  //   return Object.fromEntries(allOptions.map((e) => [e.value, e.name]))
  // }, [allOptions])

  const onClickX = useCallback((e) => {
    setSelectedItems((items) => items.remove(e.target.attributes['data-value'].value))
  }, [])

  // on the surrounding <div>, padding only on left side (pl-2) because on the right, we'll let the clickable X have the padding
  // p-2 on the <a> because we want the gap on the left and right (and top) of the X to be clickable
  const chosenItems = (
    <div className='max-w-md p-1'>
      {selectedItems.valueSeq().map((item: any) => {
        return (
          // bg-blue-700
          <div
            className={
            'select-none inline-block text-white text-sm rounded pl-2 py-1 mr-1 my-1 border ' +
              (itemClassFn ? itemClassFn(item) : '')
          }
            key={item.value}
          >
            <span>{item.name}</span>
            <a data-value={item.value} className='p-2 pl-1 text-sm cursor-pointer' onClick={onClickX}>×</a>
          </div>
        )
      }
      )}
    </div>
  )

  const toggleValue = useCallback((item) => {
    // TODO figure out what's going on with the typechecker here
    setSelectedItems((items) => {
      if (items.includes(item.value)) {
        return items.remove(item.value)
      } else {
        return items.set(item.value, item)
      }
    })
    if (inputRef.current) {
        const current: HTMLInputElement = inputRef.current
        current.focus()
    }
  }, [inputRef, setSelectedItems])

  const onClick = useCallback((e) => {
    const value = e.target.attributes['data-value'].value
    toggleValue(allOptionsMap.get(value))
  }, [toggleValue, allOptionsMap])

  const renderItem = useCallback(function (row) {
    const { index, style } = row
    const element = filteredOptions[index]
    return (
      <button
        data-value={element.value}
        data-name={element.name}
        className={
          'select-list py-1 px-2 border w-48 text-left hover:bg-green-100' +
            (index === highlightIndex ? ' bg-green-100' : ' bg-white')
        }
        style={style}
        onClick={onClick}
        key={index}
        role='menuitem'
      >
        {element.name}
      </button>
    )
  }, [filteredOptions, onClick, highlightIndex])

  const filteredList = (
    <div className='absolute z-10 w-96'>
      <FixedSizeList
        height={360}
        itemCount={filteredOptions.length}
        itemSize={36}
        initialScrollOffset={0}
        ref={listRef}
      >
        {renderItem}
      </FixedSizeList>
    </div>
  )

  const onInputChange = useCallback((e) => {
    setInput(e.target.value)
    setHighlightIndex(0)
  }, [])

  return (
    <div className='flex flex-col items-center'>
      {chosenItems}
      <div className='mt-2'>
        <input
          value={input}
          className='w-96 p-2 border rounded-sm'
          placeholder='Add place...'
          onChange={onInputChange}
          onClick={() => setIsTyping(true)}
          ref={inputRef}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onKeyPress={onKeyPress}
          onBlur={(e) => {
            if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).classList.contains('select-list')) {
              setIsTyping(false)
              setInput('')
            }
          }}
        />
        {isTyping && filteredList}
      </div>
    </div>
  )
}
