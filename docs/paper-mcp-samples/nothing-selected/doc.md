# Paper MCP

## Screenshot

Format is image/jpeg. Width is 2000 pixels. Height is 1763 pixels.
Decoded size is 195879 bytes. The server note was "Note: Image was resized to 2000x1763px to fit size limits.".

Width and height are the JPEG frame header in
docs/paper-mcp-samples/nothing-selected/screenshot.jpg.
The tool JSON has neither field.

## Nothing selected

get_selection payload:

```json
{
  "selectedNodes": [],
  "count": 0
}
```

get_screenshot used file 01M3NSDXNCKM0QFAGTRH3BF0CC and node BN1-0. The node is the
first artboard returned by get_basic_info. The selection count was 0.

The full tool result, including the file prelude, is
docs/paper-mcp-samples/nothing-selected/get_selection.json.
