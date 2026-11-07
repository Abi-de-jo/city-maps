#!/usr/bin/env python3
"""Create a valid, empty ESRI polygon shapefile zip for the OpenMapTiles
"water-polygons-split-3857.zip" input.

Why: Planetiler requires an ocean water-polygons file, but that file lives on
osmdata.openstreetmap.de, which is unreachable from some networks. For inland
regions (and any region where the host is blocked) an empty placeholder is fine
— inland water still comes from the OSM extract; only ocean fill is skipped.

Usage: make-empty-water-polygons.py <output.zip>
"""
import datetime
import os
import struct
import sys
import tempfile
import zipfile


def _shp_header(shape_type: int, file_len_words: int) -> bytes:
    b = bytearray()
    b += struct.pack(">i", 9994)          # file code
    b += b"\x00" * 20                     # unused
    b += struct.pack(">i", file_len_words)
    b += struct.pack("<i", 1000)          # version
    b += struct.pack("<i", shape_type)    # 5 = polygon
    b += struct.pack("<8d", 0, 0, 0, 0, 0, 0, 0, 0)  # bbox
    assert len(b) == 100
    return bytes(b)


def write_shapefile(base: str) -> None:
    header = _shp_header(5, 50)  # empty -> 100 bytes
    with open(base + ".shp", "wb") as f:
        f.write(header)
    with open(base + ".shx", "wb") as f:
        f.write(header)

    # .dbf: dBASE III, zero records, one dummy numeric field.
    num_fields = 1
    header_size = 32 + 32 * num_fields + 1
    record_size = 1 + 10
    today = datetime.date.today()
    d = bytearray()
    d += struct.pack("<B", 3)
    d += struct.pack("<BBB", today.year - 1900, today.month, today.day)
    d += struct.pack("<I", 0)              # records
    d += struct.pack("<H", header_size)
    d += struct.pack("<H", record_size)
    d += b"\x00" * 20
    field = b"id".ljust(11, b"\x00") + b"N" + b"\x00" * 4
    field += struct.pack("<B", 10) + struct.pack("<B", 0) + b"\x00" * 14
    d += field
    d += b"\x0d"
    with open(base + ".dbf", "wb") as f:
        f.write(bytes(d))

    with open(base + ".prj", "w") as f:
        f.write(
            'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",'
            'SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],'
            'UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],'
            'PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],'
            'PARAMETER["false_easting",0],PARAMETER["false_northing",0],'
            'UNIT["metre",1],AXIS["X",EAST],AXIS["Y",NORTH]]'
        )


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    out = sys.argv[1]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    name = "water-polygons-split-3857"
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, name)
        write_shapefile(base)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for ext in ("shp", "shx", "dbf", "prj"):
                z.write(base + "." + ext, name + "." + ext)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
