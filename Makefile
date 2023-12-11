CC=gcc
CFLAGS=-I.
BUILD_DIR=build
SRC_DIR=nsync

# Source files
SRC_FILES=$(SRC_DIR)/nsync.c $(SRC_DIR)/config.c

# Object files for native and cross compilation
OBJ_FILES=$(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.o,$(SRC_FILES))
CROSS_OBJ_FILES=$(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%_cross.o,$(SRC_FILES))

# Create build directory if it does not exist
$(shell mkdir -p $(BUILD_DIR))

# Native compilation
all: $(BUILD_DIR)/nsync

$(BUILD_DIR)/nsync: $(OBJ_FILES)
	$(CC) -o $@ $^

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) -c $< -o $@ $(CFLAGS)

# Cross-compilation using Docker
CROSS_CC=x86_64-linux-gnu-gcc
CROSS_LDFLAGS=-lm -static
DOCKER_IMAGE=buildpack-deps:stable
DOCKER_RUN=docker run --rm -v "$(PWD)":/usr/src/myapp -w /usr/src/myapp $(DOCKER_IMAGE)

cross: $(BUILD_DIR)/nsync-linux-x86-64

$(BUILD_DIR)/nsync-linux-x86-64: $(CROSS_OBJ_FILES)
	$(DOCKER_RUN) $(CROSS_CC) -o $@ $^ $(CROSS_LDFLAGS)

$(BUILD_DIR)/%_cross.o: $(SRC_DIR)/%.c
	$(DOCKER_RUN) $(CROSS_CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -rf $(BUILD_DIR)












# TARGET = nsync/nsync
# CROSS_TARGET = build/nsync-linux-x86-64
# SRC = nsync/nsync.c
# LIBS = -lm
# DOCKER_IMAGE = buildpack-deps:stable
# DOCKER_CONTAINER = nsync_cross_compile
# PYTHON_PACKAGE_VERSION = 0.1.0

# .PHONY: all clean egg

# all: $(TARGET)

# $(CROSS_TARGET): $(SRC)
# 	docker run --rm --name $(DOCKER_CONTAINER) --platform linux/amd64 -v $(PWD):/project -w /project -it $(DOCKER_IMAGE) gcc -static -o $(CROSS_TARGET) -march=x86-64 $(SRC) $(LIBS)

# clean:
# 	rm -f $(TARGET)
# 	docker rm -f $(DOCKER_CONTAINER)

# $(TARGET): $(SRC)
# 	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
