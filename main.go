package main

import "fmt"

type Size int

const (
	ExtraSmall Size = iota
	Small
	Medium
	Large
	ExtraLarge
)

func main() {
	fmt.Println(ExtraSmall, Small, Medium, Large, ExtraLarge)

}
