# Custom Test Runner - Visual Output Examples

## Input Section Display

### Stdin Mode Input Box

```
┌─────────────────────────────────────────────────────────┐
│ 📥 Input                                   [15 chars]    │
├─────────────────────────────────────────────────────────┤
│ > 10 20 30                                              │
│ > hello world                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### File Mode Input Box

```
┌─────────────────────────────────────────────────────────┐
│ 📥 Input                        [input.txt (256 bytes)]  │
├─────────────────────────────────────────────────────────┤
│ 1 2 3 4 5                                               │
│ apple banana cherry                                     │
│ [more content...]                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Result Display Examples

### Example 1: Successful Test

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Test Passed                                           │
│ Compiled Successfully                                   │
└─────────────────────────────────────────────────────────┘

📥 Input                                           [15 chars]
┌─────────────────────────────────────────────────────────┐
│ 5                                                       │
│ 1 2 3 4 5                                               │
└─────────────────────────────────────────────────────────┘

📤 Output                                          [8 chars]
┌─────────────────────────────────────────────────────────┐
│ Sum: 15                                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Clear Output                                           │
└─────────────────────────────────────────────────────────┘
```

### Example 2: Compilation Error

```
┌─────────────────────────────────────────────────────────┐
│ ❌ Test Failed                                           │
│ Compilation Error                                       │
└─────────────────────────────────────────────────────────┘

📥 Input                                          [23 chars]
┌─────────────────────────────────────────────────────────┐
│ 10                                                      │
│ 5 4 3 2 1                                               │
└─────────────────────────────────────────────────────────┘

⚠️ Stderr                                          [145 chars]
┌─────────────────────────────────────────────────────────┐
│ error: expected ';' after statement                    │
│        ^ at line 5                                      │
│ error: undefined variable 'temp'                        │
│        ^ at line 12                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Clear Output                                           │
└─────────────────────────────────────────────────────────┘
```

### Example 3: Runtime Error

```
┌─────────────────────────────────────────────────────────┐
│ ❌ Test Failed                                           │
│ Compiled Successfully                                   │
└─────────────────────────────────────────────────────────┘

📥 Input                                          [10 chars]
┌─────────────────────────────────────────────────────────┐
│ 5                                                       │
│ 0 1 2 3 4                                               │
└─────────────────────────────────────────────────────────┘

📤 Output                                           [0 chars]
┌─────────────────────────────────────────────────────────┐
│ (empty)                                                 │
└─────────────────────────────────────────────────────────┘

⚠️ Stderr                                           [512 chars]
┌─────────────────────────────────────────────────────────┐
│ Exception in thread "main" java.lang.ArrayIndexOutOf   │
│ BoundsException: 10                                     │
│     at Solution.main(Solution.java:42)                 │
│                                                         │
│ Possible causes:                                        │
│ - Array index out of bounds                            │
│ - Invalid input range                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Clear Output                                           │
└─────────────────────────────────────────────────────────┘
```

## Input Mode Selection

```
┌──────────────────────────────────────────────────────────┐
│ RUN CUSTOM TEST                    [Stdin] [File(s)]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Stdin Mode (Selected):                                  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Paste standard input here...                       │  │
│ │                                                    │  │
│ │ [15 chars]                                         │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [Run Custom Test]                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────┐
│ RUN CUSTOM TEST               [Stdin] [File(s)]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ File Mode (Selected):                                   │
│ ┌─ Choose Input File ────────────────────────────────┐  │
│ │          📤 Choose Input File                      │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ File selected: input.txt ×                              │
│                                                          │
│ [Run Custom Test]                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Loading State

```
While running:

┌──────────────────────────────────────────────────────────┐
│ [🔄 Running...]  [Disabled button]                      │
└──────────────────────────────────────────────────────────┘

Results appear below once complete.
```

## Error States

### Invalid Input

```
Toast: Error
        "Please enter input for stdin mode"
```

### No Files

```
Toast: Error
        "Please select an input file"
```

### API Failure

```
Toast: Run Failed
        "Connection timeout - please try again"

Display:
┌──────────────────────────────────────────────────────────┐
│ ❌ Test Failed                                           │
│ Error                                                    │
└──────────────────────────────────────────────────────────┘

💬 Message
┌──────────────────────────────────────────────────────────┐
│ Connection timeout - please try again                    │
└──────────────────────────────────────────────────────────┘
```

## Color Scheme Reference

| Element        | Color                  | Usage              |
| -------------- | ---------------------- | ------------------ |
| Success Header | #0d2818 (dark green)   | Passed tests       |
| Success Text   | #4ec9b0 (bright green) | Passed indicator   |
| Error Header   | #2d0000 (dark red)     | Failed tests       |
| Error Text     | #f44747 (bright red)   | Error messages     |
| Normal Output  | #d4d4d4 (light gray)   | Program output     |
| Input Text     | #569cd6 (blue)         | Input display      |
| Border         | #3c3c3c (dark gray)    | Container borders  |
| Background     | #1e1e1e (very dark)    | Section background |

## Toast Notifications

### Success Cases

```
✅ Test Completed
"Output: [first line of output up to 60 chars]..."
```

```
✅ Test Completed
"Test ran successfully"
```

### Failure Cases

```
⚠️ Test Failed
"Compilation: Error"
```

```
❌ Run Failed
"Connection timeout - please try again"
```

## Robustness Features

✅ **Graceful Degradation**

- Missing files don't crash the test runner
- Continues with available files
- Shows clear error message

✅ **Input Validation**

- Checks input provided before running
- Validates mode-specific requirements
- Prevents unnecessary API calls

✅ **Error Recovery**

- Try/catch blocks capture all errors
- Console logging for debugging
- User-friendly error messages

✅ **Output Safety**

- Scrollable containers prevent UI overflow
- Max-heights prevent layout breaks
- Word-wrapping for long lines

✅ **State Management**

- Proper loading states
- Button disabled when appropriate
- Clear output sections
- Easy to run multiple tests

## Accessibility Features

- Clear status indicators (colors + text)
- Toast notifications read by screen readers
- Proper button labels
- Keyboard accessible (tabs, enter)
- Semantic HTML structure
- Sufficient contrast ratios
