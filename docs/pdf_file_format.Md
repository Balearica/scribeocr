# Overview

Any compression/encryption notwithstanding, the PDF format is (somewhat) human-readable.  Notes regarding the PDF file format are below. 

# Text

Below is a minimal example of text within a .pdf file.

```
  BT
    /F1 18 Tf
    1 0 0 1 10 50 Tm
    [ (T) 100 (EX) 100 (T) ] TJ
    0 10 Td
    10 Ts
    [ (12) ] TJ
  ET

```


```
  BT [begin text]
    /F1 18 Tf [use font F1 at 18 pt.]
    1 0 0 1 10 50 Tm [position cursor at (10,50)]
    [ (T) 100 (EX) 100 (T) ] TJ [write string "TEXT"]
    0 10 Td [move cursor by (0,10)]
    10 Ts [move baseline up 10]
    [ (12) ] TJ [write string "12"]
  ET [end text]

```
# Operators Defined

## Key Operators

### Tf Operator
`/F0 18 Tf` sets the font to `/F0` and font size to `18`.  Fonts are defined using shorthand that references the document font dictionary. 

### TJ Operator
`[ (T) 100 (EX) 100 (T) ] TJ` writes the word "TEXT", with manual spacing between "T" and "EX" and "EX" and "T".  Spacing numbers express 1/1000 of a unit.

### Td Operator
`<x> <y> Td` moves the cursor to the beginning of the current line + `(<x>,<y>)`.  For example, moving from the end of one line to the beginning of another line might be expressed as `0 20 Td`. 

### Ts Operator
`10 Ts` moves the baseline up by 10. 

### Tm Operator
`1 0 0 1 <x> <y> Tm` moves the cursor to `(<x>,<y>)`.  The 6 arguments represent a transformation matrix, however only the last 2 arguments are used for translation.  

#### Detail
Technically speaking, the `Tm` operator defines a matrix that converts from text space to user space.  It can therefore be used to rotate a run of text by editing a single operator, or as an alternative way of scaling text (rather than setting the font size).  For example, to create 8 pt. text at (100, 100) one could use a font size of 8 and a transformation matrix of `1 0 0 1 100 100` or font size of 1 and a transformation matrix of `8 0 0 8 100 100`.

https://www.verypdf.com/document/pdf-format-reference/pg_0406.htm

## Other Operators
The following operators are related, but rarely or never used for this project.

### Tj and Tc Operators
`(Hello World) Tj` writes the string "Hello World" using a simpler syntax than `TJ` (described above) due to the absence of character-level positioning.  `5 Tc` sets the character spacing to 5 for the text.  Unfortunately, while uniform character spacing can be adjusted, the kerning data embedded in font files is not considered when characters are positioned this way.  Therefore, any font with pair kerning (which is virtually all of them) cannot be accurately represented using (only) `Tj`. 

# Non-ASCII Characters
When using `Tj` and `TJ` to show text, ASCII characters can be typed literally (e.g. `(HELLO WORLD) Tj`).  However, non-ASCII characters need to be replaced by an escape sequence (based on the specified encoding). 

This part of the PDF spec explains the idea of escape sequences for non-ASCII characters:
https://www.verypdf.com/document/pdf-format-reference/pg_0055.htm

This part of the PDF spec provides a lookup table for multiple encodings:
https://www.verypdf.com/document/pdf-format-reference/pg_0999.htm

# Embedded Fonts
Fonts in PDF are described by (1) a font dictionary and (2) [optionally] an embedded font file (called a "font program" in the PDF specification).  

1. Font dictionary
   1. "For all font types, the term font dictionary refers to a PDF dictionary containing information about the font; likewise, a CIDFont dictionary contains information about a CIDFont. Except for Type 3, this dictionary is distinct from the font pro-gram that defines the font’s glyphs. That font program may be embedded in the PDF file as a stream object or be obtained from some external source."
   2. https://www.verypdf.com/document/pdf-format-reference/pg_0411.htm
3. Embedded OpenType fonts are supported as of PDF 1.6
   1. https://www.verypdf.com/document/pdf-format-reference/pg_0466.htm
   2. "A Type1 font dictionary or CIDFontType0CID Font dictionary, if the embedded font program contains a “CFF” table without CIDFont operators."
3. Type 1 font dictionary
   1. Definition:
      1. https://www.verypdf.com/document/pdf-format-reference/pg_0413.htm
   1. Example
      1. https://www.verypdf.com/document/pdf-format-reference/pg_0415.htm
1. Glyph Metrics
   1. Even when font files are embedded, metrics are stored separately in a .pdf file
   2. "The width information for each glyph is stored both in the font dictionary and in the font program itself. (The two sets of widths must be identical; storing this in-formation in the font dictionary, although redundant, enables a consumer application to determine glyph positioning without having to look inside the fontprogram.)"
      1. https://www.verypdf.com/document/pdf-format-reference/pg_0394.htm


# Resources
1. Minimal PDF file
   1. https://brendanzagaeski.appspot.com/0004.html
1. *Developing with PDF* book, "Text" chapter
   1. https://www.oreilly.com/library/view/developing-with-pdf/9781449327903/ch04.html

# muPDF Key Functions

1. `fz_run_page` writes the contents of a page (`fz_page`) to a device (`fz_device`)
   1. https://github.com/ArtifexSoftware/mupdf/blob/e3b06e9559ffd67e8a2708104bad4cb882498b6a/include/mupdf/fitz/document.h

