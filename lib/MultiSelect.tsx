import { useState, useMemo, useRef } from 'react'
import { FixedSizeList } from 'react-window'
import { OrderedSet } from 'immutable'
import fuzzysort from 'fuzzysort'

const optionNames = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty'
]
const options = []
for (let i = 0; i < optionNames.length; i++) {
  options.push({
    name: optionNames[i],
    value: i.toString()
  })
}

export default function MultiSelect (props) {
  const [isTyping, setIsTyping] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new OrderedSet())
  const inputRef = useRef()
  const [input, setInput] = useState('')

  const optionValueToName = useMemo(() => {
    return Object.fromEntries(options.map((e) => [e.value, e.name]))
  }, [options])

  const onClickX = (e) => {
    setSelectedItems(selectedItems.remove(e.target.attributes['data-value'].value))
  }

  // on the surrounding <div>, padding only on left side (pl-2) because on the right, we'll let the clickable X have the padding
  // p-2 on the <a> because we want the gap on the left and right (and top) of the X to be clickable
  const chosenItems = (
    <div className='max-w-md p-1'>
      {selectedItems.map((item) =>
        <div className='select-none inline-block bg-blue-700 text-white rounded pl-2 py-1 m-1 border'>
          <span>{optionValueToName[item]}</span>
          <a data-value={item} className='p-2 text-sm cursor-pointer' onClick={onClickX}>×</a>
        </div>
      )}
    </div>
  )

  const onClick = (e) => {
    const value = e.target.attributes['data-value'].value
    if (selectedItems.includes(value)) {
      setSelectedItems(selectedItems.remove(value))
    } else {
      setSelectedItems(selectedItems.add(value))
    }
    inputRef.current.focus()
  }

  let filteredOptions = options.filter((option) => !selectedItems.contains(option.value))
  if (input.length > 0) {
    filteredOptions = fuzzysort.go(input, filteredOptions, { keys: ['name'], threshold: -10000 }).map((result) => result.obj)
  }

  const renderItem = function (row) {
    const { index, style } = row
    const element = filteredOptions[index]
    return (
      <button
        data-value={element.value}
        data-name={element.name}
        className='select-list py-1 px-2 border w-48 text-left bg-white hover:bg-green-100'
        style={style}
        onClick={onClick}
      >
        {element.name}
      </button>
    )
  }

  const filteredList = (
    <div className='absolute z-10 w-96'>
      <FixedSizeList
        height={360}
        itemCount={filteredOptions.length}
        itemSize={36}
        initialScrollOffset={0}
      >
        {renderItem}
      </FixedSizeList>
    </div>
  )

  return (
    <div className='flex flex-col items-center'>
      {chosenItems}
      <div className='mt-2'>
        <input
          editable
          value={input}
          className='w-96 p-2 border rounded-sm'
          placeholder='Add place...'
          onChange={(e) => setInput(e.target.value)}
          onClick={() => setIsTyping(true)}
          ref={inputRef}
          onBlur={(e) => {
            if (!e.relatedTarget || !e.relatedTarget.classList.contains('select-list')) {
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
