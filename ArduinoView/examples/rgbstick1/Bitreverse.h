#pragma once

/* Classic binary partitioning algorithm */
inline uint32_t brev32 (uint32_t a) {
    uint32_t m;
    a = (a >> 16) | (a << 16);                            // swap halfwords
    m = 0x00ff00ff; a = ((a >> 8) & m) | ((a << 8) & ~m); // swap bytes
    m = m^(m << 4); a = ((a >> 4) & m) | ((a << 4) & ~m); // swap nibbles
    m = m^(m << 2); a = ((a >> 2) & m) | ((a << 2) & ~m);
    m = m^(m << 1); a = ((a >> 1) & m) | ((a << 1) & ~m);
    return a;
}

/* Classic binary partitioning algorithm */
inline uint16_t brev16 (uint16_t a) {
    uint16_t m;
    m = 0x00ff;     a = ((a >> 8) & m) | ((a << 8) & ~m);   // swap bytes
    m = m^(m << 4); a = ((a >> 4) & m) | ((a << 4) & ~m); // swap nibbles
    m = m^(m << 2); a = ((a >> 2) & m) | ((a << 2) & ~m);
    m = m^(m << 1); a = ((a >> 1) & m) | ((a << 1) & ~m);
    return a;
}

/* Classic binary partitioning algorithm */
inline uint8_t brev8 (uint8_t a) {
    uint8_t m;
    m = 0x0f;       a = ((a >> 4) & m) | ((a << 4) & ~m);   // swap nibbles
    m = m^(m << 2); a = ((a >> 2) & m) | ((a << 2) & ~m);
    m = m^(m << 1); a = ((a >> 1) & m) | ((a << 1) & ~m);
    return a;
}

